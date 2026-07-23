import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, AlertCircle, ArrowUpDown } from 'lucide-react';
import LeadFormDialog from '@/components/LeadFormDialog';
import { formatCurrency, formatUSD } from '@/lib/currencies';

const STATUSES = ['All', 'New', 'Discovery Call Booked', 'Proposal/SOW Sent', 'Contract Sent', 'Deposit Paid', 'Follow-Up Ongoing', 'Won', 'Lost'];

const STATUS_COLORS = {
  'New': { bg: '#EEF2FF', text: '#635BFF', border: '#635BFF' },
  'Discovery Call Booked': { bg: '#F3E8FF', text: '#7C3AED', border: '#7C3AED' },
  'Proposal/SOW Sent': { bg: '#E0F7FA', text: '#0891B2', border: '#00D4FF' },
  'Contract Sent': { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6' },
  'Deposit Paid': { bg: '#FFFAEB', text: '#B45309', border: '#F79009' },
  'Follow-Up Ongoing': { bg: '#FFF7ED', text: '#C2410C', border: '#FB8500' },
  'Won': { bg: '#ECFDF3', text: '#0D9068', border: '#0D9068' },
  'Lost': { bg: '#FEF3F2', text: '#D92D20', border: '#D92D20' }
};

const formatMoney = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n || 0);
const formatDate = (d) => d ? new Date(d).toLocaleDateString() : '-';

const LeadLog = ({ leads, onUpdate }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortField, setSortField] = useState('date_created');
  const [sortDir, setSortDir] = useState('desc');
  const [selectedLead, setSelectedLead] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const filteredLeads = useMemo(() => {
    let result = [...leads];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(l =>
        l.lead_name?.toLowerCase().includes(q) ||
        l.company?.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q) ||
        l.qualifier_name?.toLowerCase().includes(q) ||
        l.closer_name?.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== 'All') {
      result = result.filter(l => l.status === statusFilter);
    }

    result.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (aVal === undefined || aVal === null) aVal = '';
      if (bVal === undefined || bVal === null) bVal = '';
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortDir === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });

    return result;
  }, [leads, search, statusFilter, sortField, sortDir]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const handleRowClick = (lead) => {
    setSelectedLead(lead);
    setIsFormOpen(true);
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>Lead Log</h2>
        <p className="text-sm text-muted-foreground mt-1">Filter, sort, and manage all leads in a table view</p>
      </div>

      <Card className="border border-border shadow-[0_2px_5px_rgba(10,37,64,0.04),0_0_1px_rgba(10,37,64,0.08)]">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} strokeWidth={2} />
              <Input placeholder="Search by name, company, email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="lead-log-search" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-56" data-testid="lead-log-status-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border">
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground cursor-pointer" onClick={() => handleSort('lead_name')}>
                    <div className="flex items-center gap-1">Lead <ArrowUpDown size={12} /></div>
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Company</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground cursor-pointer" onClick={() => handleSort('status')}>Status</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Type</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Qualifier</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Closer</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground cursor-pointer text-right" onClick={() => handleSort('total_deal_value_usd')}>Contract Value</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground text-right">MRR / Deposit</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground text-right">Earnings</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Currency</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground cursor-pointer" onClick={() => handleSort('date_created')}>Created</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Alerts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">No leads found</TableCell>
                  </TableRow>
                ) : filteredLeads.map(lead => {
                  const statusColor = STATUS_COLORS[lead.status] || STATUS_COLORS['New'];
                  const isAging = lead.aging_flag;
                  const currency = lead.currency || 'USD';
                  const isRecurring = lead.payment_type === 'Recurring';
                  const contractValue = isRecurring ? lead.projected_contract_value : lead.total_deal_value;
                  const contractValueUsd = isRecurring ? lead.projected_contract_value_usd : lead.total_deal_value_usd;
                  return (
                    <TableRow key={lead.lead_id} onClick={() => handleRowClick(lead)} className={`cursor-pointer hover:bg-background ${isAging ? 'bg-destructive-bg' : ''}`} data-testid={`lead-log-row-${lead.lead_id}`}>
                      <TableCell className="font-medium text-foreground">{lead.lead_name}</TableCell>
                      <TableCell className="text-secondary-text">{lead.company || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" style={{ backgroundColor: statusColor.bg, color: statusColor.text, borderColor: statusColor.border + '40' }} className="text-xs font-medium">
                          {lead.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {isRecurring ? (
                          <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">Recurring</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs bg-background text-secondary-text border-border">One-Time</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-secondary-text text-sm">{lead.qualifier_name || '-'}</TableCell>
                      <TableCell className="text-secondary-text text-sm">{lead.closer_name || '-'}</TableCell>
                      <TableCell className="text-right text-foreground font-medium" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                        <div>{formatCurrency(contractValue, currency)}</div>
                        {currency !== 'USD' && <div className="text-xs text-muted-foreground">≈ {formatUSD(contractValueUsd)}</div>}
                      </TableCell>
                      <TableCell className="text-right text-secondary-text" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                        {isRecurring
                          ? `${formatCurrency(lead.monthly_retainer_amount, currency)}/mo`
                          : formatCurrency(lead.deposit_amount, currency)}
                      </TableCell>
                      <TableCell className="text-right text-success font-medium" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{formatCurrency(lead.earnings, currency)}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">{currency}</Badge></TableCell>
                      <TableCell className="text-muted-foreground text-sm">{formatDate(lead.date_created)}</TableCell>
                      <TableCell>
                        {isAging && (
                          <Badge variant="outline" className="bg-destructive-bg text-destructive border-destructive/30 text-xs">
                            <AlertCircle size={10} className="mr-1" />Aging
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 text-sm text-muted-foreground">
            Showing {filteredLeads.length} of {leads.length} leads
          </div>
        </CardContent>
      </Card>

      {isFormOpen && (
        <LeadFormDialog isOpen={isFormOpen} onClose={() => { setIsFormOpen(false); setSelectedLead(null); }} onSuccess={onUpdate} lead={selectedLead} />
      )}
    </div>
  );
};

export default LeadLog;
