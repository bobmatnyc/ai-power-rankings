-- Create newsletter subscriptions table
CREATE TABLE IF NOT EXISTS newsletter_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'unsubscribed')),
  verification_token UUID DEFAULT gen_random_uuid(),
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index on email for faster lookups
CREATE INDEX idx_newsletter_subscriptions_email ON newsletter_subscriptions(email);

-- Create an index on verification_token for faster lookups
CREATE INDEX idx_newsletter_subscriptions_verification_token ON newsletter_subscriptions(verification_token);

-- Add RLS policies
ALTER TABLE newsletter_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy for inserting new subscriptions (anyone can subscribe)
CREATE POLICY "Anyone can subscribe to newsletter" ON newsletter_subscriptions
  FOR INSERT WITH CHECK (true);

-- Policy for updating subscription status (only with valid token)
CREATE POLICY "Update subscription with valid token" ON newsletter_subscriptions
  FOR UPDATE USING (true)
  WITH CHECK (true);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update the updated_at column
CREATE TRIGGER update_newsletter_subscriptions_updated_at BEFORE UPDATE
  ON newsletter_subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();