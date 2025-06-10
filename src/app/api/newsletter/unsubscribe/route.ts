import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/database';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(
      new URL('/newsletter/unsubscribe?status=error&error=missing-token', request.url)
    );
  }

  const supabase = createClient();

  try {
    // Find subscription by token
    const { data: subscription, error: findError } = await supabase
      .from('newsletter_subscriptions')
      .select('*')
      .eq('verification_token', token)
      .single();

    if (findError || !subscription) {
      console.error('Find error:', findError);
      return NextResponse.redirect(
        new URL('/newsletter/unsubscribe?status=error&error=invalid-token', request.url)
      );
    }

    // Update subscription status to unsubscribed
    const { error: updateError } = await supabase
      .from('newsletter_subscriptions')
      .update({ 
        status: 'unsubscribed',
        unsubscribed_at: new Date().toISOString()
      })
      .eq('verification_token', token);

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.redirect(
        new URL('/newsletter/unsubscribe?status=error&error=unsubscribe-failed', request.url)
      );
    }

    return NextResponse.redirect(
      new URL('/newsletter/unsubscribe?status=success', request.url)
    );
  } catch (error) {
    console.error('Unsubscribe error:', error);
    return NextResponse.redirect(
      new URL('/newsletter/unsubscribe?status=error', request.url)
    );
  }
}