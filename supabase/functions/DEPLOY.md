# Deploy Edge Functions

## Setup (one time)

1. Install Supabase CLI:
```bash
npm install -g supabase
```

2. Login to Supabase:
```bash
supabase login
```

3. Link your project:
```bash
cd midi-kyb-portal
supabase link --project-ref enklmqdmuyxtczusmjtv
```

4. Set the Anthropic API key as a secret:
```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-your-key-here
```

## Deploy

```bash
supabase functions deploy extract-document
```

## Test locally

```bash
supabase functions serve extract-document --env-file .env.local
```

Create a `.env.local` file with:
```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```
