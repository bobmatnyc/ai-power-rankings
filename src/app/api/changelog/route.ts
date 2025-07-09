import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export async function GET() {
  try {
    const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');
    const changelogContent = await readFile(changelogPath, 'utf-8');
    
    // Parse the changelog content
    const releases = parseChangelog(changelogContent);
    
    // Filter to only recent releases (last 3 releases or last 30 days)
    const recentReleases = releases.slice(0, 3);
    
    // Transform to the format expected by the modal
    const changelogData = recentReleases.flatMap(release => 
      release.items.map(item => ({
        id: `${release.version}-${item.category}-${item.title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`,
        title: item.title,
        description: item.description,
        date: release.date,
        category: "Platform",
        type: getCategoryType(item.category),
        version: release.version
      }))
    );
    
    return NextResponse.json(changelogData);
  } catch (error) {
    console.error('Error reading changelog:', error);
    return NextResponse.json([]);
  }
}

interface ChangelogItem {
  category: string;
  title: string;
  description: string;
}

interface Release {
  version: string;
  date: string;
  items: ChangelogItem[];
}

function parseChangelog(content: string): Release[] {
  const releases: Release[] = [];
  const lines = content.split('\n');
  
  let currentRelease: Release | null = null;
  let currentCategory = '';
  
  for (const line of lines) {
    // Match release headers like "## [3.1.0] - 2025-07-01"
    const releaseMatch = line.match(/^## \[([^\]]+)\] - (\d{4}-\d{2}-\d{2})/);
    if (releaseMatch) {
      if (currentRelease) {
        releases.push(currentRelease);
      }
      currentRelease = {
        version: releaseMatch[1] || 'Unknown',
        date: (releaseMatch[2] || new Date().toISOString().split('T')[0])!,
        items: []
      };
      currentCategory = '';
      continue;
    }
    
    // Match category headers like "### Added"
    const categoryMatch = line.match(/^### (.+)/);
    if (categoryMatch) {
      currentCategory = categoryMatch[1] || 'General';
      continue;
    }
    
    // Match list items like "- **Interactive Tool Links**: Description"
    const itemMatch = line.match(/^- \*\*([^*]+)\*\*: (.+)/);
    if (itemMatch && currentRelease && currentCategory) {
      currentRelease.items.push({
        category: currentCategory,
        title: itemMatch[1] || 'Update',
        description: itemMatch[2] || 'Platform update'
      });
      continue;
    }
    
    // Match simple list items like "- Item description"
    const simpleItemMatch = line.match(/^- (.+)/);
    if (simpleItemMatch && currentRelease && currentCategory) {
      // Skip if it's a sub-item (starts with spaces)
      if (!line.startsWith('  ')) {
        currentRelease.items.push({
          category: currentCategory,
          title: simpleItemMatch[1]?.split(':')[0] || simpleItemMatch[1]?.substring(0, 50) || 'Update',
          description: simpleItemMatch[1] || 'Platform update'
        });
      }
    }
  }
  
  // Add the last release
  if (currentRelease) {
    releases.push(currentRelease);
  }
  
  return releases;
}

function getCategoryType(category: string): "feature" | "improvement" | "fix" | "news" {
  switch (category.toLowerCase()) {
    case 'added':
      return 'feature';
    case 'changed':
      return 'improvement';
    case 'fixed':
      return 'fix';
    case 'removed':
      return 'improvement';
    default:
      return 'feature';
  }
}