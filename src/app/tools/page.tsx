'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Tool {
  id: string
  name: string
  category: string
  status: string
  description?: string
  website?: string
  github_url?: string
}

export default function ToolsPage(): React.JSX.Element {
  const [tools, setTools] = useState<Tool[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('name')

  useEffect(() => {
    fetchTools()
  }, [])

  const fetchTools = async (): Promise<void> => {
    try {
      const response = await fetch('/api/tools')
      const data = await response.json()
      setTools(data.tools)
      setLoading(false)
    } catch (error) {
      console.error('Failed to fetch tools:', error)
      setLoading(false)
    }
  }

  const categories = ['all', ...new Set(tools.map(t => t.category))]
  
  const filteredTools = selectedCategory === 'all' 
    ? tools 
    : tools.filter(t => t.category === selectedCategory)

  const sortedTools = [...filteredTools].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name)
      case 'category':
        return a.category.localeCompare(b.category)
      case 'status':
        return a.status.localeCompare(b.status)
      default:
        return 0
    }
  })

  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      'autonomous-agent': 'bg-purple-500',
      'code-editor': 'bg-blue-500',
      'ide-assistant': 'bg-green-500',
      'app-builder': 'bg-orange-500',
      'open-source-framework': 'bg-cyan-500',
      'testing-tool': 'bg-red-500',
      'code-review': 'bg-yellow-500'
    }
    return colors[category] || 'bg-gray-500'
  }

  const getStatusBadge = (status: string): React.JSX.Element => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      'active': 'default',
      'beta': 'secondary',
      'acquired': 'destructive',
      'deprecated': 'outline'
    }
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>
  }

  if (loading) {
    return (
      <div className="container mx-auto p-8">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading tools...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">AI Coding Tools Directory</h1>
        <p className="text-muted-foreground text-lg">
          Explore all {tools.length} AI coding tools in our database
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map(cat => (
              <SelectItem key={cat} value={cat}>
                {cat === 'all' ? 'All Categories' : cat.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="category">Category</SelectItem>
            <SelectItem value="status">Status</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedTools.map((tool) => (
          <Card key={tool.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle className="text-xl">{tool.name}</CardTitle>
                {getStatusBadge(tool.status)}
              </div>
              <CardDescription>
                <Badge className={`${getCategoryColor(tool.category)} text-white`}>
                  {tool.category.replace(/-/g, ' ')}
                </Badge>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {tool.description || 'AI-powered coding assistant helping developers write better code faster.'}
              </p>
              <div className="flex gap-2">
                <Button asChild size="sm">
                  <Link href={`/tools/${tool.id}`}>
                    View Details
                  </Link>
                </Button>
                {tool.website && (
                  <Button asChild size="sm" variant="outline">
                    <a href={tool.website} target="_blank" rel="noopener noreferrer">
                      Website
                    </a>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Tools</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{tools.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{categories.length - 1}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Tools</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{tools.filter(t => t.status === 'active').length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Open Source</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{tools.filter(t => t.category === 'open-source-framework').length}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}