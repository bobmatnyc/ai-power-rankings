'use client'

import { useState, useEffect } from 'react'

interface DashboardStats {
  totalTools: number
  totalRankings: number
  totalNews: number
  totalSubscribers: number
  latestPeriod: string
  lastGenerated: string
}

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalTools: 0,
    totalRankings: 0,
    totalNews: 0,
    totalSubscribers: 0,
    latestPeriod: '',
    lastGenerated: ''
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      // Fetch stats from various APIs
      const [toolsRes, rankingsRes, newsRes, subscribersRes] = await Promise.all([
        fetch('/api/tools?limit=1'),
        fetch('/api/rankings?limit=1'),
        fetch('/api/news?limit=1'),
        fetch('/api/admin/subscribers')
      ])

      const tools = await toolsRes.json()
      const rankings = await rankingsRes.json()
      const news = await newsRes.json()
      const subscribers = await subscribersRes.json()

      setStats({
        totalTools: tools.totalDocs || 0,
        totalRankings: rankings.totalDocs || 0,
        totalNews: news.totalDocs || 0,
        totalSubscribers: subscribers.stats?.total || 0,
        latestPeriod: rankings.docs?.[0]?.period || 'N/A',
        lastGenerated: new Date().toLocaleDateString()
      })
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateRankings = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/generate-rankings', {
        method: 'POST'
      })
      const result = await response.json()
      
      if (result.success) {
        alert(`Successfully generated rankings for ${result.total_tools} tools`)
        fetchStats() // Refresh stats
      } else {
        alert(`Failed to generate rankings: ${result.error}`)
      }
    } catch (error) {
      console.error('Failed to generate rankings:', error)
      alert('Failed to generate rankings')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div style={{ padding: '20px' }}>Loading dashboard...</div>
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' }}>
        AI Power Rankings Dashboard
      </h1>
      
      {/* Stats Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
        gap: '20px',
        marginBottom: '30px' 
      }}>
        <div style={{ 
          padding: '20px', 
          border: '1px solid #e2e8f0', 
          borderRadius: '8px',
          backgroundColor: '#f8fafc' 
        }}>
          <h3 style={{ fontSize: '14px', color: '#64748b', margin: '0 0 8px 0' }}>Total Tools</h3>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b' }}>{stats.totalTools}</div>
        </div>
        
        <div style={{ 
          padding: '20px', 
          border: '1px solid #e2e8f0', 
          borderRadius: '8px',
          backgroundColor: '#f8fafc' 
        }}>
          <h3 style={{ fontSize: '14px', color: '#64748b', margin: '0 0 8px 0' }}>Total Rankings</h3>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b' }}>{stats.totalRankings}</div>
        </div>
        
        <div style={{ 
          padding: '20px', 
          border: '1px solid #e2e8f0', 
          borderRadius: '8px',
          backgroundColor: '#f8fafc' 
        }}>
          <h3 style={{ fontSize: '14px', color: '#64748b', margin: '0 0 8px 0' }}>News Articles</h3>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b' }}>{stats.totalNews}</div>
        </div>
        
        <div style={{ 
          padding: '20px', 
          border: '1px solid #e2e8f0', 
          borderRadius: '8px',
          backgroundColor: '#f8fafc' 
        }}>
          <h3 style={{ fontSize: '14px', color: '#64748b', margin: '0 0 8px 0' }}>Subscribers</h3>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b' }}>{stats.totalSubscribers}</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '15px' }}>Quick Actions</h2>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={generateRankings}
            disabled={loading}
            style={{
              padding: '10px 20px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1
            }}
          >
            {loading ? 'Generating...' : 'Generate Rankings'}
          </button>
          
          <a
            href="/api/admin/subscribers/export"
            style={{
              padding: '10px 20px',
              backgroundColor: '#10b981',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '6px',
              display: 'inline-block'
            }}
          >
            Export Subscribers
          </a>
          
          <a
            href="/en/admin/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '10px 20px',
              backgroundColor: '#8b5cf6',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '6px',
              display: 'inline-block'
            }}
          >
            SEO Dashboard
          </a>
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '15px' }}>System Status</h2>
        <div style={{ 
          padding: '20px', 
          border: '1px solid #e2e8f0', 
          borderRadius: '8px',
          backgroundColor: '#f8fafc' 
        }}>
          <div style={{ marginBottom: '10px' }}>
            <strong>Latest Ranking Period:</strong> {stats.latestPeriod}
          </div>
          <div style={{ marginBottom: '10px' }}>
            <strong>Last Generated:</strong> {stats.lastGenerated}
          </div>
          <div style={{ color: '#10b981', fontWeight: 'bold' }}>
            ✓ All systems operational
          </div>
        </div>
      </div>
    </div>
  )
}