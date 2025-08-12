"use client";
import React, { useState, useEffect } from 'react';
import { useApi } from '@/hooks/use-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Activity, 
  AlertTriangle, 
  Clock, 
  Database, 
  Gauge, 
  RefreshCw,
  TrendingUp,
  Zap
} from 'lucide-react';

interface PerformanceMetrics {
  database: {
    totalQueries: number;
    averageDuration: number;
    slowQueries: number;
    errorRate: number;
    connections: {
      total: number;
      idle: number;
      waiting: number;
    };
  };
  api: {
    totalRequests: number;
    averageResponseTime: number;
    slowRequests: number;
    errorRate: number;
    cacheHitRate: number;
  };
  frontend: {
    bundleSize: number;
    loadTime: number;
    renderTime: number;
    memoryUsage: number;
  };
}

interface SlowQuery {
  query: string;
  duration: number;
  timestamp: Date;
  type: 'database' | 'api';
}

export function PerformanceDashboard() {
  const api = useApi();
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [slowQueries, setSlowQueries] = useState<SlowQuery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchMetrics = async () => {
    try {
      const [metricsResponse, slowQueriesResponse] = await Promise.all([
        api.get('/admin/performance/metrics'),
        api.get('/admin/performance/slow-queries'),
      ]);

      setMetrics(metricsResponse.data);
      setSlowQueries(slowQueriesResponse.data);
    } catch (error) {
      console.error('Failed to fetch performance metrics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchMetrics, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [autoRefresh]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Loading performance metrics...</span>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load performance metrics. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  const getPerformanceStatus = (value: number, thresholds: { good: number; warning: number }) => {
    if (value <= thresholds.good) return { status: 'good', color: 'bg-green-500' };
    if (value <= thresholds.warning) return { status: 'warning', color: 'bg-yellow-500' };
    return { status: 'critical', color: 'bg-red-500' };
  };

  const dbStatus = getPerformanceStatus(metrics.database.averageDuration, { good: 100, warning: 500 });
  const apiStatus = getPerformanceStatus(metrics.api.averageResponseTime, { good: 200, warning: 1000 });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Performance Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor your application's performance metrics and optimize bottlenecks
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={fetchMetrics}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Now
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Database Performance</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.database.averageDuration}ms</div>
            <p className="text-xs text-muted-foreground">Average query time</p>
            <div className="flex items-center mt-2">
              <div className={`w-2 h-2 rounded-full mr-2 ${dbStatus.color}`} />
              <span className="text-sm capitalize">{dbStatus.status}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Performance</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.api.averageResponseTime}ms</div>
            <p className="text-xs text-muted-foreground">Average response time</p>
            <div className="flex items-center mt-2">
              <div className={`w-2 h-2 rounded-full mr-2 ${apiStatus.color}`} />
              <span className="text-sm capitalize">{apiStatus.status}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
            <Gauge className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.api.cacheHitRate}%</div>
            <p className="text-xs text-muted-foreground">Requests served from cache</p>
            <Progress value={metrics.api.cacheHitRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.database.errorRate}%</div>
            <p className="text-xs text-muted-foreground">Failed requests</p>
            {metrics.database.errorRate > 5 && (
              <Badge variant="destructive" className="mt-2">High</Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics */}
      <Tabs defaultValue="database" className="space-y-4">
        <TabsList>
          <TabsTrigger value="database">Database</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
          <TabsTrigger value="frontend">Frontend</TabsTrigger>
          <TabsTrigger value="slow-queries">Slow Queries</TabsTrigger>
        </TabsList>

        <TabsContent value="database" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Query Statistics</CardTitle>
                <CardDescription>Database query performance metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Total Queries</span>
                  <span className="text-sm">{metrics.database.totalQueries.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Average Duration</span>
                  <span className="text-sm">{metrics.database.averageDuration}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Slow Queries</span>
                  <Badge variant={metrics.database.slowQueries > 10 ? "destructive" : "secondary"}>
                    {metrics.database.slowQueries}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Error Rate</span>
                  <span className="text-sm">{metrics.database.errorRate}%</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Connection Pool</CardTitle>
                <CardDescription>Database connection statistics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Total Connections</span>
                  <span className="text-sm">{metrics.database.connections.total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Idle Connections</span>
                  <span className="text-sm">{metrics.database.connections.idle}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Waiting Clients</span>
                  <Badge variant={metrics.database.connections.waiting > 0 ? "destructive" : "secondary"}>
                    {metrics.database.connections.waiting}
                  </Badge>
                </div>
                
                <div className="pt-4">
                  <div className="text-sm font-medium mb-2">Connection Usage</div>
                  <Progress 
                    value={(metrics.database.connections.total - metrics.database.connections.idle) / metrics.database.connections.total * 100} 
                    className="h-2" 
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {metrics.database.connections.total - metrics.database.connections.idle} of {metrics.database.connections.total} in use
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="api" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>API Performance</CardTitle>
                <CardDescription>HTTP request performance metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Total Requests</span>
                  <span className="text-sm">{metrics.api.totalRequests.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Average Response Time</span>
                  <span className="text-sm">{metrics.api.averageResponseTime}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Slow Requests</span>
                  <Badge variant={metrics.api.slowRequests > 20 ? "destructive" : "secondary"}>
                    {metrics.api.slowRequests}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Error Rate</span>
                  <span className="text-sm">{metrics.api.errorRate}%</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Caching Performance</CardTitle>
                <CardDescription>Request caching effectiveness</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className="text-3xl font-bold">{metrics.api.cacheHitRate}%</div>
                  <p className="text-sm text-muted-foreground">Cache Hit Rate</p>
                </div>
                <Progress value={metrics.api.cacheHitRate} className="h-2" />
                
                {metrics.api.cacheHitRate < 70 && (
                  <Alert>
                    <TrendingUp className="h-4 w-4" />
                    <AlertDescription>
                      Consider implementing more aggressive caching strategies to improve performance.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="frontend" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Bundle Performance</CardTitle>
                <CardDescription>Frontend bundle and load metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Bundle Size</span>
                  <span className="text-sm">{(metrics.frontend.bundleSize / 1024 / 1024).toFixed(2)}MB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Load Time</span>
                  <span className="text-sm">{metrics.frontend.loadTime}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Render Time</span>
                  <span className="text-sm">{metrics.frontend.renderTime}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Memory Usage</span>
                  <span className="text-sm">{(metrics.frontend.memoryUsage / 1024 / 1024).toFixed(2)}MB</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance Recommendations</CardTitle>
                <CardDescription>Suggestions for optimization</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {metrics.frontend.bundleSize > 5 * 1024 * 1024 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>Bundle size is large. Consider code splitting.</AlertDescription>
                  </Alert>
                )}
                {metrics.frontend.loadTime > 3000 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>Load time is slow. Optimize critical resources.</AlertDescription>
                  </Alert>
                )}
                {metrics.frontend.memoryUsage > 100 * 1024 * 1024 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>High memory usage. Check for memory leaks.</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="slow-queries" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Slow Queries</CardTitle>
              <CardDescription>
                Queries and requests taking longer than expected
              </CardDescription>
            </CardHeader>
            <CardContent>
              {slowQueries.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No slow queries detected. Great performance! 🎉
                </p>
              ) : (
                <div className="space-y-4">
                  {slowQueries.slice(0, 10).map((query, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1 mr-4">
                        <div className="text-sm font-mono text-muted-foreground truncate">
                          {query.query}
                        </div>
                        <div className="flex items-center mt-1 space-x-2">
                          <Badge variant={query.type === 'database' ? 'default' : 'secondary'}>
                            {query.type}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(query.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold">
                          <Clock className="inline h-3 w-3 mr-1" />
                          {query.duration}ms
                        </div>
                        {query.duration > 5000 && (
                          <Badge variant="destructive" className="text-xs">Critical</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {slowQueries.length > 10 && (
                    <p className="text-center text-muted-foreground">
                      ... and {slowQueries.length - 10} more slow queries
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default PerformanceDashboard;