# Vercel Deployment Troubleshooting Guide

## Issue: Toggle functionality not connecting to database on Vercel

### Most Likely Causes:

1. **Missing Environment Variables**
2. **Incorrect Supabase RLS Policies**
3. **API Route Configuration Issues**
4. **Service Role Key Permissions**

---

## ✅ **Step-by-Step Fix:**

### 1. **Verify Vercel Environment Variables**

Go to your Vercel project dashboard → Settings → Environment Variables

**Required Variables:**
```bash
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

**CRITICAL:** Make sure `SUPABASE_SERVICE_ROLE_KEY` is added to **Production** environment in Vercel.

### 2. **Check Supabase RLS Policies**

Your service role key needs to bypass RLS or you need proper policies:

```sql
-- In Supabase SQL Editor, run this to check current policies:
SELECT * FROM pg_policies WHERE tablename = 'fm_station';

-- If needed, add this policy to allow service role updates:
CREATE POLICY "Allow service role to update stations"
ON fm_station FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);
```

### 3. **Test Your Deployment**

After deploying with debug logging, test these endpoints:

**Health Check (NEW):**
```bash
GET https://your-vercel-app.vercel.app/api/health
```

**Test Station Update:**
```bash
curl -X PATCH https://your-vercel-app.vercel.app/api/stations/1 \
  -H "Content-Type: application/json" \
  -d '{"onAir": true}'
```

### 4. **Check Vercel Function Logs**

1. Go to Vercel Dashboard → Your Project → Functions tab
2. Click on any function execution to see logs
3. Look for the 🔍 debug messages to identify the issue

### 5. **Common Issues & Solutions:**

#### **Issue: Environment Variables Not Set**
**Symptoms:** `SERVICE_ROLE_KEY exists: false`
**Solution:**
1. Vercel Dashboard → Settings → Environment Variables
2. Add `SUPABASE_SERVICE_ROLE_KEY` for Production environment
3. Redeploy the project

#### **Issue: RLS (Row Level Security) Blocking Updates**
**Symptoms:** `PGRST116` or permission denied errors
**Solution:** Run in Supabase SQL Editor:
```sql
-- Disable RLS temporarily to test
ALTER TABLE fm_station DISABLE ROW LEVEL SECURITY;

-- Or create service role policy
CREATE POLICY "Allow service role updates" ON fm_station
FOR ALL TO service_role USING (true) WITH CHECK (true);
```

#### **Issue: Wrong Table/Column Names**
**Symptoms:** `column "on_air" of relation "fm_station" does not exist`
**Solution:** Check your Supabase table structure matches:
- Table name: `fm_station`
- Columns: `id_fm`, `on_air`, `inspection_68`

#### **Issue: Service Role Key Truncated**
**Symptoms:** Authentication failed, wrong key length
**Solution:** Your service role key should start with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.`

### 6. **Deployment Checklist:**

- [ ] Environment variables added to Vercel Production
- [ ] Supabase URL and Service Role Key are correct
- [ ] RLS policies allow service role access
- [ ] Table and column names match your schema
- [ ] API health check returns `status: "healthy"`
- [ ] Toggle test works via direct API call

### 7. **After Fixing - Remove Debug Logs**

Once working, remove debug logs from production for security:
- Remove console.log statements from API routes
- Delete the `/api/health` endpoint if not needed

---

## Quick Fix Commands:

```bash
# Test health check locally
curl http://localhost:3000/api/health

# Test station update locally
curl -X PATCH http://localhost:3000/api/stations/1 \
  -H "Content-Type: application/json" \
  -d '{"onAir": true}'

# Check environment variables are loaded
node -e "console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0,20)); console.log('KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0,20))"
```