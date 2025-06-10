-- Add unsubscribed_at column to newsletter_subscriptions
ALTER TABLE newsletter_subscriptions 
ADD COLUMN unsubscribed_at TIMESTAMP WITH TIME ZONE;

-- Update status check constraint to include 'unsubscribed'
ALTER TABLE newsletter_subscriptions 
DROP CONSTRAINT IF EXISTS newsletter_subscriptions_status_check;

ALTER TABLE newsletter_subscriptions 
ADD CONSTRAINT newsletter_subscriptions_status_check 
CHECK (status IN ('pending', 'verified', 'unsubscribed'));

-- Create index for finding active subscribers
CREATE INDEX idx_newsletter_active_subscribers 
ON newsletter_subscriptions(status, verified_at) 
WHERE status = 'verified';