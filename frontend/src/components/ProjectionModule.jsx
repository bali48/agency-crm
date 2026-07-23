import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { TrendingUp, TrendingDown, Target, Calendar, Repeat, DollarSign } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const formatMoney = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n || 0);

const ProjectionModule = ({ leads }) => {
  const [projection, setProjection] = useState(null);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(true);

  const fetchProjection = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/metrics/projection`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { month }
      });
      setProjection(response.data);
    } catch (error) {
      console.error('Failed to fetch projection:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjection();
  }, [month, leads]);

  if (loading || !projection) {
    return <div className="text-center py-12 text-muted-foreground">Loading projections...</div>;
  }

  const oneTimeChart = [
    { name: 'Worst Case', value: projection.one_time_projection.worst_case, fill: '#D92D20' },
    { name: 'Expected', value: projection.one_time_projection.expected_case, fill: '#635BFF' },
    { name: 'Best Case', value: projection.one_time_projection.best_case, fill: '#0D9068' }
  ];

  const mrrChart = [
    { name: 'Worst Case New MRR', value: projection.mrr_projection.worst_case_new_mrr, fill: '#D92D20' },
    { name: 'Expected New MRR', value: projection.mrr_projection.expected_new_mrr, fill: '#635BFF' },
    { name: 'Best Case New MRR', value: projection.mrr_projection.best_case_new_mrr, fill: '#0D9068' }
  ];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>Projection Module</h2>
          <p className="text-sm text-muted-foreground mt-1">Forecast end-of-month One-Time revenue and New MRR — all figures in USD</p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-muted-foreground" />
          <Label className="text-sm">Month:</Label>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" data-testid="projection-month-input" />
        </div>
      </div>

      {/* Assumptions */}
      <Card className="mb-6 border border-border shadow-[0_2px_5px_rgba(10,37,64,0.04)]">
        <CardHeader>
          <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>Forecast Assumptions</CardTitle>
          <CardDescription>Based on historical performance data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Scheduled Calls</p>
              <p className="text-xl font-bold text-foreground" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{projection.scheduled_calls}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Show-Up Rate</p>
              <p className="text-xl font-bold text-foreground" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{projection.show_up_rate}%</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Proposal Rate</p>
              <p className="text-xl font-bold text-foreground" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{projection.proposal_rate}%</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Close Rate</p>
              <p className="text-xl font-bold text-foreground" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{projection.close_rate}%</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Avg One-Time Deal</p>
              <p className="text-xl font-bold text-foreground" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{formatMoney(projection.avg_one_time_deal_size)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Avg MRR/Deal</p>
              <p className="text-xl font-bold text-foreground" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{formatMoney(projection.avg_mrr_deal_size)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Running Total Active MRR */}
      <Card className="mb-6 border-2 border-primary bg-gradient-to-r from-primary to-primary-hover text-white">
        <CardContent className="p-6 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider opacity-80 mb-1 flex items-center gap-2"><Repeat size={14} strokeWidth={2} /> Total Active MRR</p>
            <p className="text-3xl font-bold" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{formatMoney(projection.mrr_projection.current_active_mrr)}</p>
            <p className="text-xs opacity-80 mt-1">Running MRR line from active retainers</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider opacity-80 mb-1">Projected End of Month</p>
            <p className="text-2xl font-bold" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{formatMoney(projection.mrr_projection.projected_total_mrr_end_of_month)}</p>
          </div>
        </CardContent>
      </Card>

      {/* One-Time Projection */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="text-success" size={20} strokeWidth={2} />
          <h3 className="text-lg font-bold text-foreground" style={{ fontFamily: 'Manrope, sans-serif' }}>One-Time Revenue Projection</h3>
        </div>
        <div className="grid md:grid-cols-3 gap-4 mb-4">
          <Card className="border-2 border-destructive bg-destructive-bg shadow-[0_2px_5px_rgba(10,37,64,0.04)]" data-testid="onetime-worst">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="text-destructive" size={20} strokeWidth={2} />
                <p className="text-sm font-semibold uppercase tracking-wider text-destructive">Worst Case</p>
              </div>
              <p className="text-3xl font-bold text-destructive" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{formatMoney(projection.one_time_projection.worst_case)}</p>
              <p className="text-xs text-muted-foreground mt-2">70% of expected</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-primary bg-white shadow-[0_2px_5px_rgba(10,37,64,0.04)]" data-testid="onetime-expected">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <Target className="text-primary" size={20} strokeWidth={2} />
                <p className="text-sm font-semibold uppercase tracking-wider text-primary">Expected</p>
              </div>
              <p className="text-3xl font-bold text-primary" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{formatMoney(projection.one_time_projection.expected_case)}</p>
              <p className="text-xs text-muted-foreground mt-2">Based on average performance</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-success bg-success-bg shadow-[0_2px_5px_rgba(10,37,64,0.04)]" data-testid="onetime-best">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="text-success" size={20} strokeWidth={2} />
                <p className="text-sm font-semibold uppercase tracking-wider text-success">Best Case</p>
              </div>
              <p className="text-3xl font-bold text-success" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{formatMoney(projection.one_time_projection.best_case)}</p>
              <p className="text-xs text-muted-foreground mt-2">130% of expected</p>
            </CardContent>
          </Card>
        </div>
        <Card className="border border-border shadow-[0_2px_5px_rgba(10,37,64,0.04)]">
          <CardContent className="p-6">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={oneTimeChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E6E8EB" />
                <XAxis dataKey="name" stroke="#687B8E" />
                <YAxis stroke="#687B8E" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => formatMoney(v)} />
                <Bar dataKey="value" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* New MRR Projection */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Repeat className="text-primary" size={20} strokeWidth={2} />
          <h3 className="text-lg font-bold text-foreground" style={{ fontFamily: 'Manrope, sans-serif' }}>New MRR Projection</h3>
        </div>
        <div className="grid md:grid-cols-3 gap-4 mb-4">
          <Card className="border-2 border-destructive bg-destructive-bg shadow-[0_2px_5px_rgba(10,37,64,0.04)]" data-testid="mrr-worst">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="text-destructive" size={20} strokeWidth={2} />
                <p className="text-sm font-semibold uppercase tracking-wider text-destructive">Worst Case New MRR</p>
              </div>
              <p className="text-3xl font-bold text-destructive" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{formatMoney(projection.mrr_projection.worst_case_new_mrr)}</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-primary bg-white shadow-[0_2px_5px_rgba(10,37,64,0.04)]" data-testid="mrr-expected">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <Target className="text-primary" size={20} strokeWidth={2} />
                <p className="text-sm font-semibold uppercase tracking-wider text-primary">Expected New MRR</p>
              </div>
              <p className="text-3xl font-bold text-primary" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{formatMoney(projection.mrr_projection.expected_new_mrr)}</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-success bg-success-bg shadow-[0_2px_5px_rgba(10,37,64,0.04)]" data-testid="mrr-best">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="text-success" size={20} strokeWidth={2} />
                <p className="text-sm font-semibold uppercase tracking-wider text-success">Best Case New MRR</p>
              </div>
              <p className="text-3xl font-bold text-success" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{formatMoney(projection.mrr_projection.best_case_new_mrr)}</p>
            </CardContent>
          </Card>
        </div>
        <Card className="border border-border shadow-[0_2px_5px_rgba(10,37,64,0.04)]">
          <CardContent className="p-6">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={mrrChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E6E8EB" />
                <XAxis dataKey="name" stroke="#687B8E" />
                <YAxis stroke="#687B8E" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => formatMoney(v)} />
                <Bar dataKey="value" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProjectionModule;
