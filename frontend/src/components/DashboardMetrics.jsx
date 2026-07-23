import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { DollarSign, TrendingUp, Users, Phone, AlertCircle, Target, Percent, Save, Repeat, Layers } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CHART_COLORS = ['#635BFF', '#0D9068', '#F79009', '#D92D20', '#00D4FF', '#7C3AED'];

const formatMoney = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n || 0);

const MetricCard = ({ label, value, icon: Icon, isDanger, isMoney, subtitle, testId, accentColor }) => (
  <Card className={`border ${isDanger ? 'border-destructive bg-destructive-bg' : 'border-border'} shadow-[0_2px_5px_rgba(10,37,64,0.04),0_0_1px_rgba(10,37,64,0.08)]`} data-testid={testId}>
    <CardContent className="p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDanger ? 'bg-destructive/10' : (accentColor ? `bg-[${accentColor}]/10` : 'bg-primary/10')}`}>
          <Icon size={18} className={isDanger ? 'text-destructive' : (accentColor ? '' : 'text-primary')} style={accentColor ? { color: accentColor } : {}} strokeWidth={2} />
        </div>
      </div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1 font-medium">{label}</p>
      <p className={`text-2xl font-bold leading-none ${isDanger ? 'text-destructive' : 'text-foreground'}`} style={{ fontFamily: 'JetBrains Mono, monospace' }}>
        {isMoney ? formatMoney(value) : value}
      </p>
      {subtitle && <p className="text-xs text-muted-foreground mt-2">{subtitle}</p>}
    </CardContent>
  </Card>
);

const DashboardMetrics = ({ leads }) => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ qualifier: 'all', closer: 'all', source: 'all' });
  const [oneTimeGoal, setOneTimeGoal] = useState(0);
  const [mrrGoal, setMrrGoal] = useState(0);
  const [oneTimeGoalInput, setOneTimeGoalInput] = useState(0);
  const [mrrGoalInput, setMrrGoalInput] = useState(0);

  const currentMonth = new Date().toISOString().slice(0, 7);

  const qualifiers = [...new Set(leads.map(l => l.qualifier_name).filter(Boolean))];
  const closers = [...new Set(leads.map(l => l.closer_name).filter(Boolean))];
  const sources = [...new Set(leads.map(l => l.source).filter(Boolean))];

  const fetchMetrics = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const params = {};
      if (filters.qualifier !== 'all') params.qualifier_filter = filters.qualifier;
      if (filters.closer !== 'all') params.closer_filter = filters.closer;
      if (filters.source !== 'all') params.source_filter = filters.source;

      const response = await axios.get(`${API}/metrics/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      setMetrics(response.data);
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchGoal = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/revenue-goals/${currentMonth}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOneTimeGoal(response.data.one_time_goal || 0);
      setMrrGoal(response.data.recurring_mrr_goal || 0);
      setOneTimeGoalInput(response.data.one_time_goal || 0);
      setMrrGoalInput(response.data.recurring_mrr_goal || 0);
    } catch (error) {
      console.error('Failed to fetch goal:', error);
    }
  }, [currentMonth]);

  const updateGoal = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API}/revenue-goals/${currentMonth}`,
        {
          one_time_goal: parseFloat(oneTimeGoalInput) || 0,
          recurring_mrr_goal: parseFloat(mrrGoalInput) || 0
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setOneTimeGoal(parseFloat(oneTimeGoalInput) || 0);
      setMrrGoal(parseFloat(mrrGoalInput) || 0);
      toast.success('Revenue goals updated');
    } catch (error) {
      toast.error('Failed to update goals');
    }
  };

  useEffect(() => {
    fetchMetrics();
    fetchGoal();
  }, [filters, leads, fetchMetrics, fetchGoal]);

  if (loading || !metrics) {
    return <div className="text-center py-12 text-muted-foreground">Loading dashboard...</div>;
  }

  const { qualifier_metrics, closer_metrics, money_metrics } = metrics;
  const oneTimeCompletion = oneTimeGoal > 0 ? Math.min((money_metrics.one_time_revenue / oneTimeGoal) * 100, 100) : 0;
  const mrrCompletion = mrrGoal > 0 ? Math.min((money_metrics.new_mrr_added / mrrGoal) * 100, 100) : 0;
  const lossReasonData = Object.entries(closer_metrics.loss_reasons || {}).map(([name, value]) => ({ name, value }));
  const projectTypeData = Object.entries(closer_metrics.project_type_breakdown || {}).map(([name, v]) => ({ name, count: v.count, revenue: v.revenue_usd }));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>Visibility Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-1">Auto-calculated metrics from your lead data — all figures in USD</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6 border border-border shadow-[0_2px_5px_rgba(10,37,64,0.04)]">
        <CardContent className="p-4 flex flex-wrap gap-3">
          <div className="min-w-[160px]">
            <Label className="text-xs">Qualifier</Label>
            <Select value={filters.qualifier} onValueChange={(v) => setFilters({...filters, qualifier: v})}>
              <SelectTrigger data-testid="filter-qualifier"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Qualifiers</SelectItem>
                {qualifiers.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[160px]">
            <Label className="text-xs">Closer</Label>
            <Select value={filters.closer} onValueChange={(v) => setFilters({...filters, closer: v})}>
              <SelectTrigger data-testid="filter-closer"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Closers</SelectItem>
                {closers.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[160px]">
            <Label className="text-xs">Source</Label>
            <Select value={filters.source} onValueChange={(v) => setFilters({...filters, source: v})}>
              <SelectTrigger data-testid="filter-source"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {sources.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* One-Time Revenue */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="text-success" size={20} strokeWidth={2} />
          <h3 className="text-lg font-bold text-foreground" style={{ fontFamily: 'Manrope, sans-serif' }}>One-Time Revenue</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Contracts Signed" value={money_metrics.one_time_contracts_signed} icon={DollarSign} isMoney testId="metric-onetime-signed" accentColor="#0D9068" />
          <MetricCard label="Revenue Generated" value={money_metrics.one_time_revenue} icon={DollarSign} isMoney testId="metric-onetime-revenue" accentColor="#0D9068" />
          <MetricCard label="Cash Collected" value={money_metrics.one_time_cash_collected} icon={DollarSign} isMoney testId="metric-onetime-cash" accentColor="#0D9068" />
          <MetricCard label="Total Deposits" value={money_metrics.one_time_deposits} icon={DollarSign} isMoney testId="metric-onetime-deposits" accentColor="#0D9068" />
          <MetricCard label="Deposit → Paid In Full" value={`${money_metrics.deposit_to_paid_pct}%`} icon={Percent} testId="metric-deposit-paid-pct" />
          <MetricCard label="Avg Days to Collect" value={money_metrics.avg_days_to_collect} icon={TrendingUp} testId="metric-days-to-collect" />
          <MetricCard label="Refunds / Clawbacks" value={money_metrics.refunds} icon={AlertCircle} isMoney isDanger={money_metrics.refunds > 0} testId="metric-refunds" />
          <MetricCard label="Total Commissions" value={money_metrics.total_commissions} icon={DollarSign} isMoney testId="metric-commissions" />
        </div>
      </div>

      {/* Recurring / MRR */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Repeat className="text-primary" size={20} strokeWidth={2} />
          <h3 className="text-lg font-bold text-foreground" style={{ fontFamily: 'Manrope, sans-serif' }}>Recurring Revenue (MRR)</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Total Active MRR" value={money_metrics.total_active_mrr} icon={Repeat} isMoney testId="metric-total-mrr" accentColor="#635BFF" />
          <MetricCard label="New MRR Added" value={money_metrics.new_mrr_added} icon={TrendingUp} isMoney testId="metric-new-mrr" accentColor="#635BFF" />
          <MetricCard label="Retainer Churn" value={money_metrics.retainer_churn_count} icon={AlertCircle} isDanger={money_metrics.retainer_churn_count > 0} testId="metric-churn-count" subtitle={money_metrics.churned_mrr > 0 ? `-${formatMoney(money_metrics.churned_mrr)} MRR` : null} />
          <MetricCard label="Recurring Cash Collected" value={money_metrics.recurring_cash_collected} icon={DollarSign} isMoney testId="metric-recurring-cash" accentColor="#635BFF" />
        </div>
      </div>

      {/* Revenue Goals */}
      <Card className="mb-6 border border-border shadow-[0_2px_5px_rgba(10,37,64,0.04)]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>Revenue Goals — {currentMonth}</CardTitle>
              <CardDescription>Split by One-Time and Recurring MRR</CardDescription>
            </div>
            <Target className="text-primary" size={20} strokeWidth={2} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6 mb-4">
            <div>
              <Label>One-Time Goal ($)</Label>
              <Input type="number" value={oneTimeGoalInput} onChange={(e) => setOneTimeGoalInput(e.target.value)} data-testid="one-time-goal-input" />
              <div className="mt-2">
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium text-foreground" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                    {formatMoney(money_metrics.one_time_revenue)} / {formatMoney(oneTimeGoal)} ({oneTimeCompletion.toFixed(1)}%)
                  </span>
                </div>
                <Progress value={oneTimeCompletion} className="h-2" />
              </div>
            </div>
            <div>
              <Label>New MRR Goal ($)</Label>
              <Input type="number" value={mrrGoalInput} onChange={(e) => setMrrGoalInput(e.target.value)} data-testid="mrr-goal-input" />
              <div className="mt-2">
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium text-foreground" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                    {formatMoney(money_metrics.new_mrr_added)} / {formatMoney(mrrGoal)} ({mrrCompletion.toFixed(1)}%)
                  </span>
                </div>
                <Progress value={mrrCompletion} className="h-2" />
              </div>
            </div>
          </div>
          <Button onClick={updateGoal} className="bg-primary hover:bg-primary-hover text-white" data-testid="save-goals-button">
            <Save size={16} strokeWidth={2} className="mr-2" />
            Save Goals
          </Button>
        </CardContent>
      </Card>

      {/* Net Revenue banner */}
      <Card className="mb-6 border-2 border-foreground bg-gradient-to-r from-foreground to-secondary-text text-white">
        <CardContent className="p-6 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider opacity-80 mb-1">Net Revenue (One-Time + Annualized MRR - Refunds)</p>
            <p className="text-3xl font-bold" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{formatMoney(money_metrics.net_revenue)}</p>
          </div>
          <TrendingUp size={32} strokeWidth={1.5} className="opacity-70" />
        </CardContent>
      </Card>

      {/* Qualifier Metrics */}
      <div className="mb-6">
        <h3 className="text-lg font-bold text-foreground mb-3" style={{ fontFamily: 'Manrope, sans-serif' }}>Qualifier Metrics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Outreach Sent" value={qualifier_metrics.outreach_sent} icon={Phone} testId="metric-outreach" />
          <MetricCard label="Conversations" value={qualifier_metrics.conversations} icon={Users} testId="metric-conversations" />
          <MetricCard label="Conv → Booked %" value={`${qualifier_metrics.conversations_to_booked_pct}%`} icon={Percent} testId="metric-conv-booked" />
          <MetricCard label="Speed to Lead" value={`${qualifier_metrics.speed_to_lead_minutes} min`} icon={TrendingUp} testId="metric-speed-lead" />
          <MetricCard label="Booking Lag" value={`${qualifier_metrics.booking_lag_days} days`} icon={TrendingUp} isDanger={qualifier_metrics.booking_lag_days > 4} testId="metric-booking-lag" subtitle={qualifier_metrics.booking_lag_days > 4 ? 'LEAK: > 4 days' : null} />
          <MetricCard label="Calls Scheduled" value={qualifier_metrics.calls_scheduled} icon={Phone} testId="metric-calls-scheduled" />
          <MetricCard label="Calls Taken" value={qualifier_metrics.calls_taken} icon={Phone} testId="metric-calls-taken" />
          <MetricCard label="Show-Up Rate" value={`${qualifier_metrics.show_up_rate}%`} icon={Percent} testId="metric-show-up-rate" />
          <MetricCard label="Declines" value={qualifier_metrics.declines} icon={AlertCircle} testId="metric-declines" />
          <MetricCard label="Cancels" value={qualifier_metrics.cancels} icon={AlertCircle} testId="metric-cancels" />
          <MetricCard label="No-Shows" value={qualifier_metrics.no_shows} icon={AlertCircle} testId="metric-no-shows" />
          <MetricCard label="DQ Rate" value={`${qualifier_metrics.dq_rate}%`} icon={Percent} testId="metric-dq-rate" />
        </div>
      </div>

      {/* Closer Metrics */}
      <div className="mb-6">
        <h3 className="text-lg font-bold text-foreground mb-3" style={{ fontFamily: 'Manrope, sans-serif' }}>Closer Metrics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <MetricCard label="Proposals Sent" value={closer_metrics.proposals_sent} icon={Layers} testId="metric-proposals-sent" />
          <MetricCard label="Proposal Rate" value={`${closer_metrics.proposal_rate}%`} icon={Percent} testId="metric-proposal-rate" />
          <MetricCard label="Close Rate" value={`${closer_metrics.close_rate}%`} icon={Percent} testId="metric-close-rate" />
          <MetricCard label="Close Rate on Proposals" value={`${closer_metrics.close_rate_on_proposals}%`} icon={Percent} testId="metric-close-rate-proposals" />
          <MetricCard label="Avg Contract Value" value={closer_metrics.avg_deal_size} icon={DollarSign} isMoney testId="metric-avg-deal" />
          <MetricCard label="Revenue Per Call" value={closer_metrics.revenue_per_call} icon={DollarSign} isMoney testId="metric-rpc" />
          <MetricCard label="Single-Call Closes" value={closer_metrics.single_call_closes} icon={Phone} testId="metric-single-call" />
          <MetricCard label="Follow-Up Closes" value={closer_metrics.followup_closes} icon={Phone} testId="metric-followup-close" />
          <MetricCard label="Follow-Up Aging (7+d)" value={closer_metrics.followup_aging_count} icon={AlertCircle} isDanger={closer_metrics.followup_aging_count > 0} testId="metric-aging-count" subtitle={closer_metrics.followup_aging_count > 0 ? 'LEAK: needs attention' : null} />
        </div>

        {/* Project Type breakdown */}
        {projectTypeData.length > 0 && (
          <Card className="mb-4 border border-border shadow-[0_2px_5px_rgba(10,37,64,0.04)]">
            <CardHeader>
              <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>Won Deals by Project Type</CardTitle>
              <CardDescription>Revenue and count split by project engagement type</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={projectTypeData}>
                  <XAxis dataKey="name" stroke="#687B8E" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#687B8E" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v, name) => name === 'revenue' ? formatMoney(v) : v} />
                  <Legend />
                  <Bar dataKey="revenue" fill="#635BFF" name="Revenue (USD)" />
                  <Bar dataKey="count" fill="#00D4FF" name="Deals Won" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Loss Reason Chart */}
        {lossReasonData.length > 0 && (
          <Card className="border border-border shadow-[0_2px_5px_rgba(10,37,64,0.04)]">
            <CardHeader>
              <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>Loss Reason Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={lossReasonData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                      {lossReasonData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={lossReasonData}>
                    <XAxis dataKey="name" stroke="#687B8E" tick={{ fontSize: 12 }} />
                    <YAxis stroke="#687B8E" />
                    <Tooltip />
                    <Bar dataKey="value" fill="#D92D20" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default DashboardMetrics;
