-- Add SELECT policy for newsletter subscriptions
-- This allows the API to check if an email already exists

CREATE POLICY "Allow select for newsletter subscription checks" ON newsletter_subscriptions
  FOR SELECT USING (true);