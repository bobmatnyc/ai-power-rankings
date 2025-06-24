/* Modified to handle OAuth login */
import config from "@payload-config";
import { RootPage, generatePageMetadata } from "@payloadcms/next/views";
import { importMap } from "../importMap";
import { redirect } from 'next/navigation';
import { auth } from '@/auth';

type Args = {
  params: Promise<{
    segments: string[];
  }>;
  searchParams: Promise<{
    [key: string]: string | string[];
  }>;
};

export const generateMetadata = ({ params, searchParams }: Args) =>
  generatePageMetadata({ config, params, searchParams });

const Page = async ({ params, searchParams }: Args) => {
  const { segments } = await params;
  
  // Check if this is the login page
  if (segments && segments.length === 1 && segments[0] === 'login') {
    // Check if user is already authenticated
    const session = await auth();
    
    if (session?.user?.email === 'bob@matsuoka.com') {
      // Already authenticated, redirect to admin
      redirect('/admin');
    } else {
      // Not authenticated, redirect to OAuth login
      redirect('/admin/auth/signin');
    }
  }
  
  return RootPage({ config, params, searchParams, importMap });
};

export default Page;
